import face_recognition
from PIL import Image, ImageDraw
import os

def test_image(image_path):
    image = face_recognition.load_image_file(image_path)
    face_locations = face_recognition.face_locations(image)
    
    if not face_locations:
        print(f"Aucun visage détecté dans {image_path}")
        return False
    
    print(f"Visage détecté dans {image_path} aux positions: {face_locations}")
    
    # Visualiser la détection
    pil_image = Image.fromarray(image)
    draw = ImageDraw.Draw(pil_image)
    
    for (top, right, bottom, left) in face_locations:
        draw.rectangle(((left, top), (right, bottom)), outline=(255,0,0))
    
    pil_image.show()
    return True

# Tester toutes les images
for img in os.listdir('data/images'):
    if img.lower().endswith(('.png', '.jpg', '.jpeg')):
        test_image(os.path.join('data/images', img))