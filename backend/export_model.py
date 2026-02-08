"""One-time script: train the model and export it to backend/model/"""
import sys
import os

# Add parent directory so we can import the training script
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from travel_buddy_xgboost_training import main

model, feature_names = main()

# Save model
model_dir = os.path.join(os.path.dirname(__file__), 'model')
os.makedirs(model_dir, exist_ok=True)

model_path = os.path.join(model_dir, 'travel_buddy.json')
model.save_model(model_path)
print(f"\nModel exported to: {model_path}")

# Save feature names
features_path = os.path.join(model_dir, 'feature_names.txt')
with open(features_path, 'w') as f:
    f.write('\n'.join(feature_names))
print(f"Feature names exported to: {features_path}")
