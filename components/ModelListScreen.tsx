import React, { useState, useEffect } from 'react';
import { supabase, BUCKET_NAME, NSFW_BUCKET_NAME } from '../supabaseClient';
import type { FileObject } from '@supabase/storage-js';

interface ModelListScreenProps {
  onBack: () => void;
  onSelectModel: (modelName: string) => void;
}

interface ModelInfo {
  name: string;
  profileImage: string;
  totalImages: number;
  sfwCount: number;
  nsfwCount: number;
}

const ModelListScreen: React.FC<ModelListScreenProps> = ({ onBack, onSelectModel }) => {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAllModels();
  }, []);

  const loadAllModels = async () => {
    setLoading(true);
    setError(null);

    try {
      // Get folders from both buckets
      const [sfwFolders, nsfwFolders] = await Promise.all([
        loadFoldersFromBucket(BUCKET_NAME),
        loadFoldersFromBucket(NSFW_BUCKET_NAME)
      ]);

      // Create a map of all unique model names
      const allModelNames = new Set([
        ...sfwFolders.map(f => f.name),
        ...nsfwFolders.map(f => f.name)
      ]);

      const modelList: ModelInfo[] = [];

      for (const modelName of allModelNames) {
        if (!modelName) continue;

        // Get image counts
        const sfwImages = await getImageCount(BUCKET_NAME, modelName);
        const nsfwImages = await getImageCount(NSFW_BUCKET_NAME, modelName);
        
        // Get profile image (prefer SFW, fallback to NSFW)
        let profileImage = '';
        if (sfwImages > 0) {
          profileImage = await getFirstImage(BUCKET_NAME, modelName);
        } else if (nsfwImages > 0) {
          profileImage = await getFirstImage(NSFW_BUCKET_NAME, modelName);
        }

        modelList.push({
          name: modelName,
          profileImage,
          totalImages: sfwImages + nsfwImages,
          sfwCount: sfwImages,
          nsfwCount: nsfwImages
        });
      }

      // Sort by total image count (most images first)
      modelList.sort((a, b) => b.totalImages - a.totalImages);
      setModels(modelList);

    } catch (err: any) {
      setError(`Failed to load models: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const loadFoldersFromBucket = async (bucketName: string): Promise<FileObject[]> => {
    try {
      const { data, error } = await supabase.storage.from(bucketName).list('', {
        limit: 1000
      });

      if (error) throw error;
      return data?.filter(item => item.id === null) || [];
    } catch (err) {
      console.error(`Error loading from ${bucketName}:`, err);
      return [];
    }
  };

  const getImageCount = async (bucketName: string, modelName: string): Promise<number> => {
    try {
      const { data, error } = await supabase.storage.from(bucketName).list(modelName, {
        limit: 1000
      });

      if (error) throw error;
      
      const imageFiles = data?.filter(file => 
        file.name.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp)$/i)
      ) || [];

      return imageFiles.length;
    } catch (err) {
      return 0;
    }
  };

  const getFirstImage = async (bucketName: string, modelName: string): Promise<string> => {
    try {
      const { data, error } = await supabase.storage.from(bucketName).list(modelName, {
        limit: 1
      });

      if (error) throw error;
      
      const imageFile = data?.find(file => 
        file.name.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp)$/i)
      );

      if (imageFile) {
        return supabase.storage.from(bucketName).getPublicUrl(`${modelName}/${imageFile.name}`).data.publicUrl;
      }

      return '';
    } catch (err) {
      return '';
    }
  };

  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-gray-900 text-white">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mb-4"></div>
        <p>Loading all models...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-gray-900 text-white p-6">
        <div className="text-red-400 mb-4">⚠️ Error loading models</div>
        <p className="text-gray-400 mb-6">{error}</p>
        <button 
          onClick={onBack}
          className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-6 rounded-full transition-colors"
        >
          Back
        </button>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-gray-900 text-white">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-gray-900/95 backdrop-blur-sm border-b border-gray-700 p-4">
        <div className="flex items-center justify-between">
          <button 
            onClick={onBack}
            className="flex items-center text-purple-400 hover:text-purple-300 transition-colors"
          >
            <span className="mr-2">←</span> Back
          </button>
          <h1 className="text-xl font-bold">Model Directory</h1>
          <div className="text-sm text-gray-400">
            {models.length} models
          </div>
        </div>
      </div>

      {/* Model Grid */}
      <div className="p-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {models.map((model) => (
            <div key={model.name} className="group">
              <button
                onClick={() => onSelectModel(model.name)}
                className="w-full bg-gray-800 rounded-xl overflow-hidden hover:ring-2 hover:ring-purple-500 transition-all transform hover:scale-105"
              >
                {/* Model Image */}
                <div className="aspect-[3/4] relative">
                  {model.profileImage ? (
                    <>
                      <img 
                        src={model.profileImage} 
                        alt={model.name}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                    </>
                  ) : (
                    <div className="w-full h-full bg-gray-700 flex items-center justify-center">
                      <span className="text-4xl">📷</span>
                    </div>
                  )}

                  {/* NSFW Badge */}
                  {model.nsfwCount > 0 && (
                    <div className="absolute top-2 right-2 bg-pink-600 text-white px-2 py-1 rounded-full text-xs font-bold">
                      18+
                    </div>
                  )}

                  {/* Model Name and Stats */}
                  <div className="absolute bottom-0 left-0 right-0 p-3">
                    <h3 className="text-white font-bold text-sm truncate mb-1">
                      {model.name}
                    </h3>
                    <div className="flex items-center justify-between text-xs text-gray-300">
                      <span>{model.totalImages} photos</span>
                      <div className="flex space-x-2">
                        {model.sfwCount > 0 && (
                          <span className="bg-blue-600 px-2 py-0.5 rounded">
                            SFW: {model.sfwCount}
                          </span>
                        )}
                        {model.nsfwCount > 0 && (
                          <span className="bg-pink-600 px-2 py-0.5 rounded">
                            NSFW: {model.nsfwCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </button>
            </div>
          ))}
        </div>

        {models.length === 0 && (
          <div className="text-center text-gray-400 py-12">
            <p className="text-xl mb-2">No models found</p>
            <p>Upload some images to get started!</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ModelListScreen;
