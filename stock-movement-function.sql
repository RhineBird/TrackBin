-- Database function for stock movement operations
-- This ensures atomic transactions and proper stock updates

CREATE OR REPLACE FUNCTION move_stock(
  p_item_id UUID,
  p_from_bin_id UUID,
  p_to_bin_id UUID,
  p_quantity INTEGER,
  p_reason TEXT,
  p_user_id UUID
) RETURNS UUID AS $$
DECLARE
  v_movement_id UUID;
  v_from_stock_entry_id UUID;
  v_to_stock_entry_id UUID;
  v_available_quantity INTEGER;
BEGIN
  -- Generate new movement ID
  v_movement_id := uuid_generate_v4();
  
  -- Check available stock in source bin
  SELECT id, quantity INTO v_from_stock_entry_id, v_available_quantity
  FROM stock_entries 
  WHERE item_id = p_item_id 
    AND bin_id = p_from_bin_id 
    AND status = 'available';
  
  -- Validate sufficient stock
  IF v_available_quantity IS NULL OR v_available_quantity < p_quantity THEN
    RAISE EXCEPTION 'Insufficient stock in source bin. Available: %, Requested: %', 
      COALESCE(v_available_quantity, 0), p_quantity;
  END IF;
  
  -- Reduce stock in source bin
  UPDATE stock_entries 
  SET quantity = quantity - p_quantity,
      updated_at = NOW()
  WHERE id = v_from_stock_entry_id;
  
  -- Check if destination bin already has stock for this item
  SELECT id INTO v_to_stock_entry_id
  FROM stock_entries 
  WHERE item_id = p_item_id 
    AND bin_id = p_to_bin_id 
    AND status = 'available';
  
  IF v_to_stock_entry_id IS NOT NULL THEN
    -- Update existing stock entry in destination bin
    UPDATE stock_entries 
    SET quantity = quantity + p_quantity,
        updated_at = NOW()
    WHERE id = v_to_stock_entry_id;
  ELSE
    -- Create new stock entry in destination bin
    INSERT INTO stock_entries (item_id, bin_id, quantity, status)
    VALUES (p_item_id, p_to_bin_id, p_quantity, 'available');
  END IF;
  
  -- Remove source stock entry if quantity is now zero
  DELETE FROM stock_entries 
  WHERE id = v_from_stock_entry_id AND quantity = 0;
  
  -- Record the movement
  INSERT INTO stock_movements (
    id, item_id, from_bin_id, to_bin_id, quantity, moved_by_user_id, reason
  ) VALUES (
    v_movement_id, p_item_id, p_from_bin_id, p_to_bin_id, p_quantity, p_user_id, p_reason
  );
  
  RETURN v_movement_id;
END;
$$ LANGUAGE plpgsql;