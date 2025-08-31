import React, { useState, useEffect } from 'react';
import { supabase, BUCKET_NAME, NSFW_BUCKET_NAME } from '../supabaseClient';
import { ModelProfile, CustomPhotoRequest, PRICING } from '../types';
import TokenBalance from './TokenBalance';

interface ModelProfileScreenProps {
  modelName: string;
  onBack: () => void;
  onStartChat: () => void;
  userTokens: number;
  onBuyTokens: () => void;
  isCreator?: boolean;
}

const ModelProfileScreen: React.FC<ModelProfileScreenProps> = ({ modelName, onBack, onStartChat, userTokens, onBuyTokens, isCreator = false }) => {
  const [modelProfile, setModelProfile] = useState<ModelProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCustomRequestForm, setShowCustomRequestForm] = useState(false);
  const [requestText, setRequestText] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [selectedPhotoType, setSelectedPhotoType] = useState<'sfw' | 'bikini' | 'lingerie' | 'topless' | 'nude'>('sfw');
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const [selectedGalleryType, setSelectedGalleryType] = useState<'sfw' | 'nsfw'>('sfw');
  const [activeTab, setActiveTab] = useState<'gallery' | 'story' | 'requests' | 'nsfw'>('story');
  const [generatedImage, setGeneratedImage] = useState<{url: string, prompt: string, photoType: string} | null>(null);
  const [showGeneratedImage, setShowGeneratedImage] = useState(false);

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

    const tokenCost = PRICING.PHOTOS[selectedPhotoType].tokens;
    
    try {
      setLoading(true);
      
      // First, submit the request and deduct tokens
      const { data: requestId, error: submitError } = await supabase.rpc('submit_custom_photo_request', {
        p_user_id: (await supabase.auth.getUser()).data.user?.id,
        p_model_name: modelName,
        p_user_email: userEmail,
        p_photo_type: selectedPhotoType,
        p_prompt: requestText,
        p_token_cost: tokenCost
      });

      if (submitError) {
        throw new Error(submitError.message);
      }

      // Call the image generation Edge Function
      const response = await fetch('https://qmclolibbzaeewssqycy.supabase.co/functions/v1/generate-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        },
        body: JSON.stringify({
          prompt: requestText,
          photoType: selectedPhotoType,
          modelName: modelName,
          userEmail: userEmail,
          userId: (await supabase.auth.getUser()).data.user?.id,
          requestId: requestId
        })
      });

      const result = await response.json();

      if (result.success) {
        // Store the generated image data
        setGeneratedImage({
          url: result.imageUrl,
          prompt: requestText,
          photoType: selectedPhotoType
        });
        setShowGeneratedImage(true);
        setShowCustomRequestForm(false);
        setRequestText('');
        setUserEmail('');
      } else {
        throw new Error(result.error || 'Image generation failed');
      }
      
    } catch (error) {
      console.error('Custom photo request error:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const openImageModal = (index: number, galleryType: 'sfw' | 'nsfw') => {
    setSelectedImageIndex(index);
    setSelectedGalleryType(galleryType);
  };

  const closeImageModal = () => {
    setSelectedImageIndex(null);
  };

  const downloadGeneratedImage = async () => {
    if (!generatedImage) return;
    try {
      const response = await fetch(generatedImage.url, { mode: 'cors' });
      const webpBlob = await response.blob();
      const bitmap = await createImageBitmap(webpBlob);
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas unsupported');
      ctx.drawImage(bitmap, 0, 0);
      const jpegBlob: Blob = await new Promise((resolve, reject) => {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('JPEG encode failed'))), 'image/jpeg', 0.92);
      });
      const url = window.URL.createObjectURL(jpegBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${modelName}_${generatedImage.photoType}_${Date.now()}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
      alert('Download failed. Please try right-clicking the image and selecting "Save image as..."');
    }
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
        <div className="relative h-48 overflow-hidden">
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
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold">Request Custom Photos</h3>
                    <TokenBalance balance={userTokens} onClick={onBuyTokens} size="small" isCreator={isCreator} />
                  </div>
                  <p className="text-gray-300 mb-6">
                    Want a specific style, pose, or setting? Submit a custom photo request and our AI will create personalized content featuring {modelProfile.name}.
                  </p>
                  
                  {/* Pricing Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                    {Object.entries(PRICING.PHOTOS).map(([type, pricing]) => (
                      <div 
                        key={type}
                        className="bg-gray-700 rounded-lg p-3 text-center"
                      >
                        <div className="font-semibold text-white">{pricing.label}</div>
                        <div className="text-purple-400 text-sm">{pricing.tokens} tokens</div>
                        <div className="text-gray-400 text-xs">${pricing.price}</div>
                      </div>
                    ))}
                  </div>
                  
                  <button 
                    onClick={() => setShowCustomRequestForm(true)}
                    className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-full transition-colors"
                  >
                    Submit Request
                  </button>
                </div>
              ) : (
                <div className="bg-gray-800 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold">Submit Custom Request</h3>
                    <TokenBalance balance={userTokens} onClick={onBuyTokens} size="small" isCreator={isCreator} />
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Photo Type</label>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {Object.entries(PRICING.PHOTOS).map(([type, pricing]) => (
                          <button
                            key={type}
                            onClick={() => setSelectedPhotoType(type as any)}
                            className={`p-3 rounded-lg border-2 transition-all ${
                              selectedPhotoType === type
                                ? 'border-purple-500 bg-purple-900/30'
                                : 'border-gray-600 bg-gray-700 hover:border-purple-400'
                            }`}
                          >
                            <div className="font-semibold text-white">{pricing.label}</div>
                            <div className="text-purple-400 text-sm">{pricing.tokens} tokens</div>
                            <div className="text-gray-400 text-xs">${pricing.price}</div>
                          </button>
                        ))}
                      </div>
                    </div>
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
                        disabled={loading || userTokens < PRICING.PHOTOS[selectedPhotoType].tokens}
                        className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:opacity-50 text-white font-bold py-2 px-6 rounded-full transition-colors flex items-center space-x-2"
                      >
                        {loading ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            <span>Generating...</span>
                          </>
                        ) : (
                          <>
                            <span>Submit Request</span>
                            <span className="text-purple-200">({PRICING.PHOTOS[selectedPhotoType].tokens} tokens)</span>
                          </>
                        )}
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

      {/* Generated Image Modal */}
      {showGeneratedImage && generatedImage && (
        <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4">
          <div className="relative max-w-4xl max-h-full bg-gray-900 rounded-lg overflow-hidden">
            <div className="absolute top-4 right-4 z-10 flex space-x-2">
              <button
                onClick={downloadGeneratedImage}
                className="bg-green-600 hover:bg-green-700 text-white p-2 rounded-full transition-colors"
                title="Download Image"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </button>
              <button
                onClick={() => setShowGeneratedImage(false)}
                className="bg-red-600 hover:bg-red-700 text-white p-2 rounded-full transition-colors"
                title="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <img 
              src={generatedImage.url}
              alt={`Generated ${generatedImage.photoType} image for ${modelName}`}
              className="max-w-full max-h-full object-contain"
            />
            
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6">
              <div className="text-white">
                <h3 className="text-xl font-bold mb-2">🎉 Your Custom Image is Ready!</h3>
                <p className="text-gray-300 mb-1">
                  <strong>Type:</strong> {PRICING.PHOTOS[generatedImage.photoType as keyof typeof PRICING.PHOTOS].label}
                </p>
                <p className="text-gray-300 mb-3">
                  <strong>Prompt:</strong> "{generatedImage.prompt}"
                </p>
                <div className="flex space-x-3">
                  <button
                    onClick={downloadGeneratedImage}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center space-x-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    <span>Download JPG</span>
                  </button>
                  <button
                    onClick={() => setShowGeneratedImage(false)}
                    className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ModelProfileScreen;