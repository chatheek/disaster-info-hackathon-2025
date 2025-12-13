// src/Auth.jsx
import { useState } from 'react';
import { supabase } from './supabaseClient';
import './Auth.css'; // <--- Import the styles

export default function Auth() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false); 

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);

    let error;
    
    if (isSignUp) {
      const { error: signUpError } = await supabase.auth.signUp({ email, password });
      error = signUpError;
      if (!error) alert('Signup successful! Check your email or try logging in.');
    } else {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      error = signInError;
    }

    if (error) alert(error.message);
    setLoading(false);
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        
        <h2 className="auth-title">
          {isSignUp ? 'Create Account' : 'Welcome Back'}
        </h2>
        <p className="auth-subtitle">
          {isSignUp ? 'Join the disaster response network' : 'Sign in to report an incident'}
        </p>

        <form onSubmit={handleAuth} className="auth-form">
          <div className="input-group">
            <input
              className="auth-input"
              type="email"
              placeholder="Email Address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          
          <div className="input-group">
            <input
              className="auth-input"
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" disabled={loading} className="auth-button">
            {loading ? 'Processing...' : (isSignUp ? 'Sign Up' : 'Log In')}
          </button>
        </form>
        
        <div className="auth-switch">
          {isSignUp ? "Already have an account?" : "Don't have an account?"}
          <span className="switch-link" onClick={() => setIsSignUp(!isSignUp)}>
            {isSignUp ? 'Log in here' : 'Sign up now'}
          </span>
        </div>

      </div>
    </div>
  );
}