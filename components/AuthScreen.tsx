import React, { useState } from 'react';
import { supabase } from '../supabaseClient';

const AuthScreen: React.FC = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMessage('Check your email for a confirmation link!');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        // The onAuthStateChange listener in App.tsx will handle the session update
      }
    } catch (err: any) {
      setError(err.error_description || err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full text-white p-4 animate-fade-in">
      <div className="w-full max-w-sm p-8 bg-gray-800 rounded-2xl shadow-lg">
        <h1 className="text-3xl font-bold mb-2 text-center text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">
          {isSignUp ? 'Create Account' : 'Welcome Back'}
        </h1>
        <p className="text-gray-400 text-center mb-6">{isSignUp ? 'Join the battle!' : 'Sign in to continue.'}</p>
        
        <div className="bg-green-600/20 border border-green-500/30 rounded-lg p-3 mb-6">
          <p className="text-green-400 text-sm font-medium text-center">
            🎉 <strong>15 Minutes FREE</strong> - Try any chat immediately, no payment required!
          </p>
        </div>

        <form onSubmit={handleAuth} className="flex flex-col gap-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="bg-gray-700 text-white px-4 py-3 rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500"
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="bg-gray-700 text-white px-4 py-3 rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500"
            required
            minLength={6}
          />
          <button
            type="submit"
            disabled={loading}
            className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {loading ? <div className="w-6 h-6 border-2 border-dashed rounded-full animate-spin"></div> : (isSignUp ? 'Sign Up' : 'Sign In')}
          </button>
        </form>

        {error && <p className="text-red-400 text-center mt-4 text-sm">{error}</p>}
        {message && <p className="text-green-400 text-center mt-4 text-sm">{message}</p>}

        <p className="text-center text-gray-400 mt-6 text-sm">
          {isSignUp ? 'Already have an account?' : "Don't have an account?"}
          <button 
            onClick={() => { 
              setIsSignUp(!isSignUp); 
              setError(null); 
              setMessage(null);
              setEmail('');
              setPassword('');
            }} 
            className="font-semibold text-purple-400 hover:text-purple-300 ml-1"
          >
            {isSignUp ? 'Sign In' : 'Sign Up'}
          </button>
        </p>
      </div>
    </div>
  );
};

export default AuthScreen;
