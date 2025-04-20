import json
import random
import time
import requests

from shape import ShapeAnimator
from rose import generate_rose_curve
import numpy as np

class RoboMasterBot:
    def __init__(self):
        self.position = [0., 0.]
        self.orientation = 0

        self.yaw = 24.0
        self.pitch = 45.0
        self.last_rose = 0.0


        # Status strings
        self.mode = "AUTONOMOUS"
        self.game_state = "SETUP"
        self.system_health = "OK"

        self.main_camera_animator = ShapeAnimator()
        self.world_map_animator = ShapeAnimator()


    def update(self):
        self.position[0] += random.uniform(-0.1, 0.1)
        self.position[1] += random.uniform(-0.1, 0.1)
        self.orientation = (self.orientation + random.uniform(-1, 1)) % 360

        self.yaw = (self.yaw - random.uniform(0, 0.5)) %( 2*3.14159)
        self.pitch = min(85, self.pitch + random.uniform(-0.5, 0.5))

        current_time: float = time.time()

        main_camera_img = self.main_camera_animator.create_frame()
        world_map_img = self.world_map_animator.create_frame()

        data =  {
            "sent_timestamp": current_time,
            "images": {
                "main_camera (this is all simulated data btw)": {
                    "image_data": main_camera_img,
                    "scale": 1,
                    "flip": False
                },
                "world_map (this is all simulated data btw)": {
                    "image_data": world_map_img,
                    "scale": 1,
                    "flip": False
                }
            },
            "graph_data": {
                "Turret Yaw (this is all simulated data btw)": [{
                    "x": current_time,
                    "y": self.yaw
                }],
                "Turret Pitch (this is all simulated data btw)": [{
                    "x": current_time,
                    "y": self.pitch
                }],

            },
            "string_data": {
                "mode (this is all simulated data btw)": {"value": self.mode},
                "game_state (this is all simulated data btw)": {"value": self.game_state},
                "system_health (this is all simulated data btw)": {"value": self.system_health}
            },
            "robot_position": {
                "x (this is all simulated data btw)": self.position[0],
                "y (this is all simulated data btw)": self.position[1],
                "heading (this is all simulated data btw)": self.orientation
            }
        }

        if abs(current_time - self.last_rose) > 1:
            self.last_rose = current_time
            data["graph_data"]["Rose Curve (this is all simulated data btw)"] = [{
                "x":0,
                "y":0,
                "settings": {
                    "clear_data": True
                }
            }]
            data["graph_data"]["Rose Curve (this is all simulated data btw)"].extend(generate_rose_curve(np.random.randint(1, 10), np.random.randint(1, 10), 100))




        return data

if __name__ == "__main__":
    bot = RoboMasterBot()
    start = time.time()
    target_fps = 1/15
    while True:
        last_sent = time.time()

        data = json.dumps(bot.update())
        URL = "http://localhost:3000/batch"

        try:
            r = requests.post(url=URL, data=data)
        except:
            print("Failed to send data to server")
            time.sleep(1)

        delta = target_fps - (time.time() - last_sent)
        if delta > 0:
            time.sleep(delta)
        else:
            print(f'Missed deadline by {-delta} seconds')

        if time.time() - start > 120:
            exit(0)
