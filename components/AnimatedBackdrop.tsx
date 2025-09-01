import React, { useState, useEffect } from 'react';
import { supabase, BUCKET_NAME } from '../supabaseClient';

interface BackdropImage {
  url: string;
  id: string;
  x: number;
  y: number;
  size: number;
  rotation: number;
}

const AnimatedBackdrop: React.FC = () => {
  const [images, setImages] = useState<BackdropImage[]>([]);
  const [allImageUrls, setAllImageUrls] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load all SFW images on component mount
  useEffect(() => {
    const loadSFWImages = async () => {
      try {
        setIsLoading(true);
        
        // Get all folders in the SFW bucket
        const { data: folders, error: foldersError } = await supabase.storage
          .from(BUCKET_NAME)
          .list('', { limit: 100 });

        if (foldersError) {
          console.error('Error loading folders:', foldersError);
          return;
        }

        const allUrls: string[] = [];

        // Load images from each folder
        for (const folder of folders) {
          if (folder.name) {
            const { data: files, error: filesError } = await supabase.storage
              .from(BUCKET_NAME)
              .list(folder.name, { limit: 100 });

            if (!filesError && files) {
              const folderUrls = files
                .filter(file => file.name.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp)$/))
                .map(file => {
                  const { data: { publicUrl } } = supabase.storage
                    .from(BUCKET_NAME)
                    .getPublicUrl(`${folder.name}/${file.name}`);
                  return publicUrl;
                });
              
              allUrls.push(...folderUrls);
            }
          }
        }

        console.log(`Loaded ${allUrls.length} SFW images for backdrop`);
        setAllImageUrls(allUrls);
        
        // Initialize with 30-40 random images
        initializeBackdrop(allUrls);
        
      } catch (error) {
        console.error('Error loading SFW images:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadSFWImages();
  }, []);

  // Initialize backdrop with grid-positioned images
  const initializeBackdrop = (urls: string[]) => {
    if (urls.length === 0) return;

    // Calculate grid dimensions to fill the screen
    const cols = 8; // 8 columns
    const rows = 6; // 6 rows = 48 total images
    const totalSlots = cols * rows;
    
    const shuffled = [...urls].sort(() => Math.random() - 0.5);
    const backdropImages: BackdropImage[] = [];
    
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const index = row * cols + col;
        const imageUrl = shuffled[index % shuffled.length];
        
        backdropImages.push({
          url: imageUrl,
          id: `backdrop-${index}`,
          x: (col * (100 / cols)) + (100 / cols / 2), // Center in grid cell
          y: (row * (100 / rows)) + (100 / rows / 2), // Center in grid cell
          size: Math.min(window.innerWidth, window.innerHeight) / 12, // Responsive size
          rotation: Math.random() * 20 - 10 // Subtle rotation (-10 to +10 degrees)
        });
      }
    }
    
    setImages(backdropImages);
  };

  // Animate ONE image sliding off and being replaced every 2 seconds
  useEffect(() => {
    if (allImageUrls.length === 0) return;

    const interval = setInterval(() => {
      setImages(prevImages => {
        if (prevImages.length === 0) return prevImages;

        const newImages = [...prevImages];
        
        // Pick one random image to slide off
        const randomIndex = Math.floor(Math.random() * newImages.length);
        const imageToRemove = newImages[randomIndex];
        
        // Mark it for sliding off to the left
        imageToRemove.x = -30; // Slide off to the left
        
        // After a short delay, replace it with a new image
        setTimeout(() => {
          setImages(currentImages => {
            const updatedImages = currentImages.filter(img => img.id !== imageToRemove.id);
            
            // Add a new image in the same position
            const randomUrl = allImageUrls[Math.floor(Math.random() * allImageUrls.length)];
            updatedImages.push({
              url: randomUrl,
              id: `backdrop-${Date.now()}`,
              x: imageToRemove.x + 30, // Start at the original position
              y: imageToRemove.y,
              size: imageToRemove.size,
              rotation: Math.random() * 20 - 10 // Subtle rotation (-10 to +10 degrees)
            });
            
            return updatedImages;
          });
        }, 500); // Wait for slide animation to complete
        
        return newImages;
      });
    }, 2000); // Every 2 seconds

    return () => clearInterval(interval);
  }, [allImageUrls]);

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-gray-900">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 to-pink-900/20" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none">
      {/* Base gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-purple-900/30 to-pink-900/30" />
      
      {/* Animated images */}
      {images.map((image) => (
        <div
          key={image.id}
          className="absolute transition-all duration-[2000ms] ease-linear opacity-75"
          style={{
            left: `${image.x}%`,
            top: `${image.y}%`,
            width: `${image.size}px`,
            height: `${image.size * 1.3}px`, // Maintain portrait aspect ratio
            transform: `rotate(${image.rotation}deg)`,
            zIndex: 1
          }}
        >
          <img
            src={image.url}
            alt=""
            className="w-full h-full object-cover rounded-lg shadow-lg"
            loading="lazy"
            onError={(e) => {
              // Hide broken images
              e.currentTarget.style.display = 'none';
            }}
          />
        </div>
      ))}
      
      {/* Overlay to ensure content readability */}
      <div className="absolute inset-0 bg-black/40" style={{ zIndex: 2 }} />
    </div>
  );
};

export default AnimatedBackdrop;
