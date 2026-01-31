import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Register from './components/Register';
import Chat from './components/Chat';
import './App.css';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [user, setUser] = useState(null);

  useEffect(() => {
    if (token) {
      // Verify token and get user
      fetch(`${process.env.REACT_APP_API_URL}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
        .then(res => res.json())
        .then(data => {
          if (data.user) {
            setUser(data.user);
          } else {
            logout();
          }
        })
        .catch(() => logout());
    }
  }, [token]);

  const login = (newToken, userData) => {
    localStorage.setItem('token', newToken);
    setToken(newToken);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  return (
    <Router>
      <div className="App">
        <Routes>
          <Route 
            path="/login" 
            element={token ? <Navigate to="/chat" /> : <Login onLogin={login} />} 
          />
          <Route 
            path="/register" 
            element={token ? <Navigate to="/chat" /> : <Register onLogin={login} />} 
          />
          <Route 
            path="/chat" 
            element={token ? <Chat token={token} user={user} onLogout={logout} /> : <Navigate to="/login" />} 
          />
          <Route 
            path="/" 
            element={<Navigate to={token ? "/chat" : "/login"} />} 
          />
        </Routes>
      </div>
    </Router>
  );
}

export default App;