-- Database functions for receipt processing with automatic stock updates

-- Function to create a receipt with stock updates
CREATE OR REPLACE FUNCTION create_receipt_with_stock_update(
  p_reference_code VARCHAR(100),
  p_supplier VARCHAR(255),
  p_received_by_user_id UUID,
  p_receipt_lines JSONB
) RETURNS UUID AS $$
DECLARE
  v_receipt_id UUID;
  v_line JSONB;
  v_line_id UUID;
  v_existing_stock_id UUID;
BEGIN
  -- Generate new receipt ID
  v_receipt_id := uuid_generate_v4();
  
  -- Create the receipt
  INSERT INTO receipts (id, reference_code, supplier, received_by_user_id)
  VALUES (v_receipt_id, p_reference_code, p_supplier, p_received_by_user_id);
  
  -- Process each receipt line
  FOR v_line IN SELECT * FROM jsonb_array_elements(p_receipt_lines)
  LOOP
    -- Generate line ID
    v_line_id := uuid_generate_v4();
    
    -- Create receipt line
    INSERT INTO receipt_lines (
      id,
      receipt_id,
      item_id,
      quantity_expected,
      quantity_received,
      bin_id
    ) VALUES (
      v_line_id,
      v_receipt_id,
      (v_line->>'item_id')::UUID,
      (v_line->>'quantity_expected')::INTEGER,
      (v_line->>'quantity_received')::INTEGER,
      (v_line->>'bin_id')::UUID
    );
    
    -- Update stock levels if quantity was actually received
    IF (v_line->>'quantity_received')::INTEGER > 0 THEN
      -- Check if stock entry exists for this item in this bin
      SELECT id INTO v_existing_stock_id
      FROM stock_entries
      WHERE item_id = (v_line->>'item_id')::UUID
        AND bin_id = (v_line->>'bin_id')::UUID
        AND status = 'available';
      
      IF v_existing_stock_id IS NOT NULL THEN
        -- Update existing stock entry
        UPDATE stock_entries
        SET quantity = quantity + (v_line->>'quantity_received')::INTEGER,
            updated_at = NOW()
        WHERE id = v_existing_stock_id;
      ELSE
        -- Create new stock entry
        INSERT INTO stock_entries (item_id, bin_id, quantity, status)
        VALUES (
          (v_line->>'item_id')::UUID,
          (v_line->>'bin_id')::UUID,
          (v_line->>'quantity_received')::INTEGER,
          'available'
        );
      END IF;
    END IF;
  END LOOP;
  
  RETURN v_receipt_id;
END;
$$ LANGUAGE plpgsql;

-- Function to update receipt quantities and adjust stock accordingly
CREATE OR REPLACE FUNCTION update_receipt_quantities(
  p_receipt_id UUID,
  p_updates JSONB
) RETURNS VOID AS $$
DECLARE
  v_update JSONB;
  v_line_record RECORD;
  v_quantity_diff INTEGER;
  v_existing_stock_id UUID;
BEGIN
  -- Process each update
  FOR v_update IN SELECT * FROM jsonb_array_elements(p_updates)
  LOOP
    -- Get the current receipt line details
    SELECT rl.*, rl.quantity_received as old_quantity_received
    INTO v_line_record
    FROM receipt_lines rl
    WHERE rl.id = (v_update->>'line_id')::UUID;
    
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Receipt line not found: %', (v_update->>'line_id');
    END IF;
    
    -- Calculate the difference in received quantity
    v_quantity_diff := (v_update->>'quantity_received')::INTEGER - v_line_record.quantity_received;
    
    -- Update the receipt line
    UPDATE receipt_lines
    SET quantity_received = (v_update->>'quantity_received')::INTEGER
    WHERE id = (v_update->>'line_id')::UUID;
    
    -- Adjust stock levels if there's a difference
    IF v_quantity_diff != 0 THEN
      -- Find existing stock entry
      SELECT id INTO v_existing_stock_id
      FROM stock_entries
      WHERE item_id = v_line_record.item_id
        AND bin_id = v_line_record.bin_id
        AND status = 'available';
      
      IF v_existing_stock_id IS NOT NULL THEN
        -- Update existing stock entry
        UPDATE stock_entries
        SET quantity = quantity + v_quantity_diff,
            updated_at = NOW()
        WHERE id = v_existing_stock_id;
        
        -- Remove stock entry if quantity becomes zero or negative
        DELETE FROM stock_entries
        WHERE id = v_existing_stock_id AND quantity <= 0;
      ELSIF v_quantity_diff > 0 THEN
        -- Create new stock entry if we're adding stock and none exists
        INSERT INTO stock_entries (item_id, bin_id, quantity, status)
        VALUES (v_line_record.item_id, v_line_record.bin_id, v_quantity_diff, 'available');
      END IF;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to get receipt summary statistics
CREATE OR REPLACE FUNCTION get_receipt_stats(
  p_start_date TIMESTAMP DEFAULT NULL,
  p_end_date TIMESTAMP DEFAULT NULL
) RETURNS TABLE(
  total_receipts BIGINT,
  total_items_expected BIGINT,
  total_items_received BIGINT,
  accuracy_percentage NUMERIC,
  total_suppliers BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(DISTINCT r.id) as total_receipts,
    COALESCE(SUM(rl.quantity_expected), 0) as total_items_expected,
    COALESCE(SUM(rl.quantity_received), 0) as total_items_received,
    CASE 
      WHEN SUM(rl.quantity_expected) > 0 
      THEN ROUND((SUM(rl.quantity_received)::NUMERIC / SUM(rl.quantity_expected)::NUMERIC) * 100, 2)
      ELSE 0
    END as accuracy_percentage,
    COUNT(DISTINCT r.supplier) as total_suppliers
  FROM receipts r
  LEFT JOIN receipt_lines rl ON r.id = rl.receipt_id
  WHERE (p_start_date IS NULL OR r.created_at >= p_start_date)
    AND (p_end_date IS NULL OR r.created_at <= p_end_date);
END;
$$ LANGUAGE plpgsql;