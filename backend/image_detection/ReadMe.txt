pip install ultralytics

from ultralytics import YOLO
from PIL import Image

model = YOLO('best.pt')  # path to your downloaded file

# Single image input
results = model('shelf_photo.jpg', conf=0.25)
results[0].show()  

# for the whole folder
results = model('path/to/folder/', conf=0.25, save=True)


# save the result
results[0].save('output.jpg')