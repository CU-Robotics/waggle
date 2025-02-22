
import numpy as np
import cv2
import time
import random
import base64
from dataclasses import dataclass
from typing import List, Tuple

@dataclass
class Shape:
    position: List[float]
    velocity: List[float]
    color: Tuple[int, int, int]
    size: float
    rotation: float = 0
    rotation_speed: float = 0

class ShapeAnimator:
    def __init__(self, width=400, height=300, num_shapes=5):
        self.width = width
        self.height = height
        self.shapes = []
        self.initialize_shapes(num_shapes)
        self.last_frame_time = time.time()

    def initialize_shapes(self, num_shapes: int):
        shape_types = ['circle', 'rectangle', 'triangle', 'star', 'pentagon']

        for _ in range(num_shapes):
            shape_type = random.choice(shape_types)

            # Random initial position and velocity
            pos = [random.uniform(0, self.width), random.uniform(0, self.height)]
            vel = [random.uniform(-100, 100), random.uniform(-100, 100)]

            # Random color in HSV for better visual variety
            hue = random.uniform(0, 1)
            color = tuple(int(x * 255) for x in cv2.cvtColor(
                np.uint8([[[hue * 180, 255, 255]]]),
                cv2.COLOR_HSV2BGR
            )[0][0])

            size = random.uniform(20, 40)
            rotation = random.uniform(0, 360)
            rotation_speed = random.uniform(-90, 90)  # degrees per second

            self.shapes.append({
                'type': shape_type,
                'shape': Shape(pos, vel, color, size, rotation, rotation_speed)
            })

    def update_position(self, shape: Shape, delta_time: float):
        # Update position with velocity
        new_pos = [
            shape.position[0] + shape.velocity[0] * delta_time,
            shape.position[1] + shape.velocity[1] * delta_time
        ]

        # Update rotation
        shape.rotation += shape.rotation_speed * delta_time

        # Bounce off walls with slight randomization
        for i in range(2):
            if new_pos[i] < shape.size or new_pos[i] > (self.width if i == 0 else self.height) - shape.size:
                shape.velocity[i] *= -1.0
                # Add some randomization to make it more interesting
                shape.velocity[i] += random.uniform(-10, 10)

        # Constrain position
        new_pos[0] = np.clip(new_pos[0], shape.size, self.width - shape.size)
        new_pos[1] = np.clip(new_pos[1], shape.size, self.height - shape.size)

        shape.position = new_pos

    def draw_shape(self, img, shape_info):
        shape = shape_info['shape']
        shape_type = shape_info['type']
        pos = (int(shape.position[0]), int(shape.position[1]))

        if shape_type == 'circle':
            cv2.circle(img, pos, int(shape.size), shape.color, -1)

        elif shape_type == 'rectangle':
            points = cv2.boxPoints((pos, (shape.size*2, shape.size*2), shape.rotation))
            points = np.int32(points)
            cv2.fillPoly(img, [points], shape.color)

        elif shape_type == 'triangle':
            points = self._get_polygon_points(pos, shape.size, 3, shape.rotation)
            cv2.fillPoly(img, [points], shape.color)

        elif shape_type == 'star':
            points = self._get_star_points(pos, shape.size, shape.rotation)
            cv2.fillPoly(img, [points], shape.color)

        elif shape_type == 'pentagon':
            points = self._get_polygon_points(pos, shape.size, 5, shape.rotation)
            cv2.fillPoly(img, [points], shape.color)

    def _get_polygon_points(self, center, size, sides, rotation):
        points = []
        for i in range(sides):
            angle = rotation + (360/sides) * i
            x = center[0] + size * np.cos(np.radians(angle))
            y = center[1] + size * np.sin(np.radians(angle))
            points.append([int(x), int(y)])
        return np.array(points)

    def _get_star_points(self, center, size, rotation):
        points = []
        for i in range(10):
            angle = rotation + 36 * i
            curr_size = size if i % 2 == 0 else size * 0.5
            x = center[0] + curr_size * np.cos(np.radians(angle))
            y = center[1] + curr_size * np.sin(np.radians(angle))
            points.append([int(x), int(y)])
        return np.array(points)

    def create_frame(self):
        # Calculate delta time
        current_time = time.time()

        delta_time = current_time - self.last_frame_time
        self.last_frame_time = current_time


        # Create a gradient background
        img = np.zeros((self.height, self.width, 3), dtype=np.uint8)
        for y in range(self.height):
            color = int(255 * (y / self.height))
            img[y, :] = [color//1, color//2, color]

        # Update and draw shapes
        for shape_info in self.shapes:
            self.update_position(shape_info['shape'], delta_time)
            self.draw_shape(img, shape_info)


        # Convert to base64
        _, buffer = cv2.imencode('.jpg', img)
        return base64.b64encode(buffer).decode('utf-8')
