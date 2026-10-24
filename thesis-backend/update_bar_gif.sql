-- Update bar with ID 11 to include the uploaded GIF
UPDATE bars 
SET video_path = 'uploads/bars/bar_gif_11_1773519883957.gif',
    updated_at = NOW()
WHERE id = 11;

-- Verify the update
SELECT id, name, video_path, image_path 
FROM bars 
WHERE id = 11;
