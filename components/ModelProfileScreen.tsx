import React, { useState, useEffect } from 'react';
import { supabase, BUCKET_NAME, NSFW_BUCKET_NAME } from '../supabaseClient';
import { ModelProfile, CustomPhotoRequest } from '../types';

interface ModelProfileScreenProps {
  modelName: string;
  onBack: () => void;
  onStartChat: () => void;
}

const ModelProfileScreen: React.FC<ModelProfileScreenProps> = ({ modelName, onBack, onStartChat }) => {
  const [modelProfile, setModelProfile] = useState<ModelProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCustomRequestForm, setShowCustomRequestForm] = useState(false);
  const [requestText, setRequestText] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const [selectedGalleryType, setSelectedGalleryType] = useState<'sfw' | 'nsfw'>('sfw');
  const [activeTab, setActiveTab] = useState<'gallery' | 'story' | 'requests' | 'nsfw'>('story');

  useEffect(() => {
    loadModelProfile();
  }, [modelName]);

  const loadModelProfile = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Load images from both SFW and NSFW buckets
      const [sfwImages, nsfwImages] = await Promise.all([
        loadImagesFromBucket(BUCKET_NAME, modelName),
        loadImagesFromBucket(NSFW_BUCKET_NAME, modelName)
      ]);

      // Use first SFW image as profile picture, fallback to NSFW if no SFW
      const profileImage = sfwImages[0] || nsfwImages[0] || '';

      // Mock background story (you can replace this with real data from a database)
      const backgroundStory = getModelBackgroundStory(modelName);

      setModelProfile({
        name: modelName,
        profileImage,
        backgroundStory,
        sfwImages,
        nsfwImages
      });
    } catch (err: any) {
      setError(`Failed to load model profile: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const loadImagesFromBucket = async (bucketName: string, modelName: string): Promise<string[]> => {
    try {
      const { data, error } = await supabase.storage.from(bucketName).list(modelName, {
        limit: 100
      });

      if (error) throw error;

      const imageFiles = data?.filter(file => 
        file.name.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp)$/i)
      ) || [];

      return imageFiles.map(file => 
        supabase.storage.from(bucketName).getPublicUrl(`${modelName}/${file.name}`).data.publicUrl
      );
    } catch (err) {
      console.error(`Error loading from ${bucketName}:`, err);
      return [];
    }
  };

  const getModelBackgroundStory = (modelName: string): string => {
    // Mock stories - replace with real database data
    const stories: Record<string, string> = {
      'default': `Meet ${modelName}, a stunning AI-generated model who brings beauty and elegance to every image. Each photo captures a unique moment of artistry and digital craftsmanship.`,
    };
    
    return stories[modelName.toLowerCase()] || stories['default'];
  };

  const handleCustomPhotoRequest = async () => {
    if (!requestText.trim() || !userEmail.trim()) {
      alert('Please fill in all fields');
      return;
    }

    try {
      // Here you would normally save to a database
      // For now, we'll just show a success message
      alert('Custom photo request submitted! We\'ll get back to you soon.');
      setShowCustomRequestForm(false);
      setRequestText('');
      setUserEmail('');
    } catch (err) {
      alert('Failed to submit request. Please try again.');
    }
  };

  const openImageModal = (index: number, galleryType: 'sfw' | 'nsfw') => {
    setSelectedImageIndex(index);
    setSelectedGalleryType(galleryType);
  };

  const closeImageModal = () => {
    setSelectedImageIndex(null);
  };

  const navigateImage = (direction: 'prev' | 'next') => {
    if (selectedImageIndex === null || !modelProfile) return;
    
    const currentGallery = selectedGalleryType === 'sfw' ? modelProfile.sfwImages : modelProfile.nsfwImages;
    const newIndex = direction === 'prev' 
      ? Math.max(0, selectedImageIndex - 1)
      : Math.min(currentGallery.length - 1, selectedImageIndex + 1);
    
    setSelectedImageIndex(newIndex);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-white">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mb-4"></div>
        <p>Loading model profile...</p>
      </div>
    );
  }

  if (error || !modelProfile) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-white p-6">
        <div className="text-red-400 mb-4">⚠️ Error loading profile</div>
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
    <>
      <div className="h-full overflow-y-auto bg-gray-900 text-white">
        {/* Header with Back Button */}
        <div className="sticky top-0 z-10 bg-gray-900/95 backdrop-blur-sm border-b border-gray-700 p-4">
          <button 
            onClick={onBack}
            className="flex items-center text-purple-400 hover:text-purple-300 transition-colors"
          >
            <span className="mr-2">←</span> Back
          </button>
        </div>

        {/* Hero Section with Profile Image */}
        <div className="relative h-64 overflow-hidden">
          <img 
            src={modelProfile.profileImage} 
            alt={modelProfile.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/50 to-transparent" />
          <div className="absolute bottom-6 left-6 right-6">
            <h1 className="text-4xl font-bold mb-2">{modelProfile.name}</h1>
            <div className="flex items-center space-x-4">
              <span className="bg-purple-600 text-white px-3 py-1 rounded-full text-sm">
                AI Model
              </span>
              {modelProfile.nsfwImages.length > 0 && (
                <span className="bg-pink-600 text-white px-3 py-1 rounded-full text-sm">
                  18+ Content
                </span>
              )}
              <span className="text-gray-300">
                {modelProfile.sfwImages.length + modelProfile.nsfwImages.length} photos
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="border-b border-gray-700">
          <div className="flex space-x-8 px-6">
            {['story', 'gallery', ...(modelProfile.nsfwImages.length > 0 ? ['nsfw'] : []), 'requests'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`py-4 px-2 border-b-2 font-medium capitalize transition-colors ${
                  activeTab === tab
                    ? 'border-purple-500 text-purple-400'
                    : 'border-transparent text-gray-400 hover:text-gray-300'
                }`}
              >
                {tab === 'story' ? 'About' : 
                 tab === 'gallery' ? `SFW Gallery (${modelProfile.sfwImages.length})` : 
                 tab === 'nsfw' ? `NSFW Gallery (${modelProfile.nsfwImages.length})` :
                 'Custom Requests'}
              </button>
            ))}
          </div>
        </div>

        {/* Content Sections */}
        <div className="p-6">
          {/* Background Story Tab */}
          {activeTab === 'story' && (
            <div className="max-w-3xl">
              <h2 className="text-2xl font-bold mb-4">About {modelProfile.name}</h2>
              <div className="bg-gray-800 rounded-xl p-6 mb-6">
                <p className="text-gray-300 leading-relaxed text-lg">
                  {modelProfile.backgroundStory}
                </p>
              </div>
              
              {/* Text-to-Text Chat Link */}
              <div className="bg-gradient-to-r from-purple-800 to-pink-800 rounded-xl p-6">
                <h3 className="text-xl font-bold mb-2">Chat with {modelProfile.name}</h3>
                <p className="text-gray-300 mb-4">
                  Have a conversation with this AI model using our text-to-text interface.
                </p>
                <button 
                  onClick={onStartChat}
                  className="bg-white text-gray-900 font-bold py-3 px-6 rounded-full hover:bg-gray-100 transition-colors"
                >
                  Start Conversation →
                </button>
              </div>
            </div>
          )}

          {/* SFW Gallery Tab */}
          {activeTab === 'gallery' && (
            <div>
              <h2 className="text-2xl font-bold mb-6">SFW Photo Gallery</h2>
              {modelProfile.sfwImages.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {modelProfile.sfwImages.map((image, index) => (
                    <div 
                      key={index}
                      className="aspect-square bg-gray-800 rounded-xl overflow-hidden cursor-pointer hover:ring-2 hover:ring-purple-500 transition-all transform hover:scale-105"
                      onClick={() => openImageModal(index, 'sfw')}
                    >
                      <img 
                        src={image} 
                        alt={`${modelProfile.name} SFW ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-gray-400 py-8">
                  <p>No SFW images available for this model.</p>
                </div>
              )}
            </div>
          )}

          {/* NSFW Gallery Tab */}
          {activeTab === 'nsfw' && (
            <div>
              <h2 className="text-2xl font-bold mb-6">NSFW Photo Gallery</h2>
              <div className="bg-pink-900/20 border border-pink-600 rounded-xl p-4 mb-6">
                <div className="flex items-center">
                  <span className="text-2xl mr-2">🔞</span>
                  <div>
                    <p className="text-pink-300 font-bold">18+ Content Warning</p>
                    <p className="text-gray-400 text-sm">This gallery contains adult content. Viewer discretion advised.</p>
                  </div>
                </div>
              </div>
              {modelProfile.nsfwImages.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {modelProfile.nsfwImages.map((image, index) => (
                    <div 
                      key={index}
                      className="aspect-square bg-gray-800 rounded-xl overflow-hidden cursor-pointer hover:ring-2 hover:ring-pink-500 transition-all transform hover:scale-105"
                      onClick={() => openImageModal(index, 'nsfw')}
                    >
                      <img 
                        src={image} 
                        alt={`${modelProfile.name} NSFW ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-gray-400 py-8">
                  <p>No NSFW images available for this model.</p>
                </div>
              )}
            </div>
          )}

          {/* Custom Requests Tab */}
          {activeTab === 'requests' && (
            <div className="max-w-2xl">
              <h2 className="text-2xl font-bold mb-6">Custom Photo Requests</h2>
              
              {!showCustomRequestForm ? (
                <div className="bg-gray-800 rounded-xl p-6">
                  <h3 className="text-xl font-bold mb-4">Request Custom Photos</h3>
                  <p className="text-gray-300 mb-6">
                    Want a specific style, pose, or setting? Submit a custom photo request and our AI will create personalized content featuring {modelProfile.name}.
                  </p>
                  <button 
                    onClick={() => setShowCustomRequestForm(true)}
                    className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-full transition-colors"
                  >
                    Submit Request
                  </button>
                </div>
              ) : (
                <div className="bg-gray-800 rounded-xl p-6">
                  <h3 className="text-xl font-bold mb-4">Submit Custom Request</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Your Email</label>
                      <input
                        type="email"
                        value={userEmail}
                        onChange={(e) => setUserEmail(e.target.value)}
                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder="your@email.com"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Request Details</label>
                      <textarea
                        value={requestText}
                        onChange={(e) => setRequestText(e.target.value)}
                        rows={4}
                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder="Describe the style, pose, setting, or mood you'd like..."
                      />
                    </div>
                    <div className="flex space-x-4">
                      <button 
                        onClick={handleCustomPhotoRequest}
                        className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-6 rounded-full transition-colors"
                      >
                        Submit Request
                      </button>
                      <button 
                        onClick={() => setShowCustomRequestForm(false)}
                        className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-6 rounded-full transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Image Modal */}
      {selectedImageIndex !== null && (
        <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4">
          <button
            onClick={closeImageModal}
            className="absolute top-4 right-4 text-white text-2xl hover:text-gray-300 z-10"
          >
            ✕
          </button>
          
          {/* NSFW Warning Badge */}
          {selectedGalleryType === 'nsfw' && (
            <div className="absolute top-4 left-4 bg-pink-600 text-white px-3 py-1 rounded-full text-sm z-10">
              🔞 NSFW
            </div>
          )}
          
          <button
            onClick={() => navigateImage('prev')}
            className="absolute left-4 top-1/2 transform -translate-y-1/2 text-white text-3xl hover:text-gray-300 z-10"
            disabled={selectedImageIndex === 0}
          >
            ←
          </button>
          
          <button
            onClick={() => navigateImage('next')}
            className="absolute right-4 top-1/2 transform -translate-y-1/2 text-white text-3xl hover:text-gray-300 z-10"
            disabled={selectedImageIndex === (selectedGalleryType === 'sfw' ? modelProfile.sfwImages.length - 1 : modelProfile.nsfwImages.length - 1)}
          >
            →
          </button>
          
          <img
            src={selectedGalleryType === 'sfw' ? modelProfile.sfwImages[selectedImageIndex] : modelProfile.nsfwImages[selectedImageIndex]}
            alt={`${modelProfile.name} ${selectedGalleryType.toUpperCase()} ${selectedImageIndex + 1}`}
            className="max-w-full max-h-full object-contain"
          />
          
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-white text-center">
            <p>{selectedImageIndex + 1} of {selectedGalleryType === 'sfw' ? modelProfile.sfwImages.length : modelProfile.nsfwImages.length}</p>
            <p className="text-sm text-gray-400 mt-1">{selectedGalleryType.toUpperCase()} Gallery</p>
          </div>
        </div>
      )}
    </>
  );
};

export default ModelProfileScreen;