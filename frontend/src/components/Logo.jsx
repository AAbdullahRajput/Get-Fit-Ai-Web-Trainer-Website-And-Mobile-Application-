import React from 'react';

export default function Logo({ size = 40, className = "" }) {
    // We scale the size up slightly because the image contains both the icon and the text
    const imgSize = size * 2.5;

    return (
        <div className={`logo-mark ${className}`} style={{ justifyContent: 'center' }}>
            <img 
                src="/logo.jpeg" 
                alt="GetFit Logo" 
                style={{ 
                    width: imgSize, 
                    height: 'auto', 
                    borderRadius: '16px', // Smooth corners so it looks like an app icon on dark backgrounds
                    objectFit: 'contain'
                }} 
            />
        </div>
    );
}
