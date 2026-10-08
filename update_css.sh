#!/bin/bash
sed -i 's/background: rgba(255, 255, 255, 0.45);/background: rgba(255, 255, 255, 0.25);/g' src/index.css
sed -i 's/backdrop-filter: blur(20px);/backdrop-filter: blur(28px);/g' src/index.css
sed -i 's/-webkit-backdrop-filter: blur(20px);/-webkit-backdrop-filter: blur(28px);/g' src/index.css
sed -i 's/border: 1px solid rgba(255, 255, 255, 0.5);/border: 1px solid rgba(255, 255, 255, 0.6);/g' src/index.css
sed -i 's/box-shadow: 0 8px 32px 0 rgba(99, 102, 241, 0.05);/box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.1);/g' src/index.css
