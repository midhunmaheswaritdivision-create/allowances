#!/bin/bash
sed -i 's/background: rgba(255, 255, 255, 0.65);/background: rgba(255, 255, 255, 0.45);/g' src/index.css
sed -i 's/backdrop-filter: blur(8px);/backdrop-filter: blur(12px);/g' src/index.css
sed -i 's/-webkit-backdrop-filter: blur(8px);/-webkit-backdrop-filter: blur(12px);/g' src/index.css
sed -i 's/border: 1px solid rgba(0, 0, 0, 0.08);/border: 1px solid rgba(0, 0, 0, 0.15);/g' src/index.css
