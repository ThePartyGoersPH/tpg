-- Check current video_path for all bars
SELECT id, name, video_path, image_path 
FROM bars 
WHERE id IN (11, 12, 13, 14)
ORDER BY id;

-- Update Juan Bar (ID 11) with the GIF path
UPDATE bars 
SET video_path = 'uploads/bars/bar_gif_11_1773519883957.gif',
    updated_at = NOW()
WHERE id = 11;

-- Verify the update
SELECT id, name, video_path, image_path 
FROM bars 
WHERE id = 11;
