import torch
import torch.nn as nn
from torchvision import models, transforms
from pathlib import Path

# The 81 fine-grained class names from GroceryStoreDataset in label order
CLASS_NAMES = [
    'Golden-Delicious-Apple', 'Granny-Smith-Apple', 'Pink-Lady-Apple',
    'Red-Delicious-Apple', 'Royal-Gala-Apple', 'Avocado', 'Banana', 'Kiwi',
    'Lemon', 'Lime', 'Mango', 'Cantaloupe-Melon', 'Galia-Melon',
    'Honeydew-Melon', 'Watermelon', 'Nectarine', 'Orange', 'Papaya',
    'Passion-Fruit', 'Peach', 'Pear-Anjou', 'Pear-Conference', 'Pear-Kaiser',
    'Pineapple', 'Plum', 'Pomegranate', 'Red-Grapefruit', 'Satsumas',
    'Bravo-Apple-Juice', 'Bravo-Orange-Juice', 'God-Morgon-Apple-Juice',
    'God-Morgon-Orange-Juice', 'God-Morgon-Orange-Red-Grapefruit-Juice',
    'God-Morgon-Red-Grapefruit-Juice', 'Tropicana-Apple-Juice',
    'Tropicana-Golden-Grapefruit', 'Tropicana-Juice-Smooth',
    'Tropicana-Mandarin-Morning', 'Arla-Ecological-Medium-Fat-Milk',
    'Arla-Lactose-Medium-Fat-Milk', 'Arla-Medium-Fat-Milk',
    'Arla-Standard-Milk', 'Garant-Ecological-Medium-Fat-Milk',
    'Garant-Ecological-Standard-Milk', 'Oatly-Natural-Oatghurt',
    'Oatly-Oat-Milk', 'Arla-Ecological-Sour-Cream', 'Arla-Sour-Cream',
    'Valio-Sour-Cream', 'Arla-Ecological-Yoghurt', 'Arla-Fruit-Yoghurt',
    'Arla-Natural-Yoghurt', 'Garant-Ecological-Yoghurt',
    'Yoggi-Strawberry-Yoghurt', 'Yoggi-Vanilla-Yoghurt',
    'Broccoli', 'Cabbage', 'Carrots', 'Cucumber', 'Garlic',
    'Green-Bell-Pepper', 'Red-Bell-Pepper', 'Yellow-Bell-Pepper',
    'Leek', 'Mushroom', 'Onion', 'Potato', 'Red-Beet', 'Tomato',
    'Zucchini', 'Alpro-Blueberry-Soyghurt', 'Alpro-Fresh-Soy-Milk',
    'Alpro-Mango-Maracuja-Soyghurt', 'Alpro-Natural-Soyghurt',
    'Alpro-Vanilla-Soyghurt', 'Oatly-Oat-Cream', 'Oatly-Oat-Cream-Fresh',
    'Pea-Milk', 'Skyr-Blueberry', 'Skyr-Natural', 'Skyr-Strawberry',
    'Skyr-Vanilla'
]

NUM_CLASSES = len(CLASS_NAMES)  # 81


def build_model(num_classes=NUM_CLASSES, freeze_backbone=False):
    """
    ResNet50 pretrained on ImageNet, with final layer replaced for 81 classes.
    ResNet50 is a good balance of speed and accuracy for this task.
    """
    model = models.resnet50(weights=models.ResNet50_Weights.DEFAULT)

    if freeze_backbone:
        for param in model.parameters():
            param.requires_grad = False

    # Replace the final fully-connected layer
    in_features = model.fc.in_features
    model.fc = nn.Sequential(
        nn.Dropout(0.3),
        nn.Linear(in_features, num_classes)
    )
    return model


# Standard ImageNet normalization — required since we use pretrained ResNet
TRAIN_TRANSFORMS = transforms.Compose([
    transforms.Resize((256, 256)),
    transforms.RandomCrop(224),
    transforms.RandomHorizontalFlip(),
    transforms.ColorJitter(brightness=0.2, contrast=0.2, saturation=0.2),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406],
                         std=[0.229, 0.224, 0.225])
])

EVAL_TRANSFORMS = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406],
                         std=[0.229, 0.224, 0.225])
])