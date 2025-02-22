import json
import random
import time
import requests

from shape import ShapeAnimator

class RoboMasterBot:
    def __init__(self):
        self.position = [0., 0.]
        self.orientation = 0

        self.yaw = 24.0
        self.pitch = 45.0


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

        current_time = time.time() % 10

        main_camera_img = self.main_camera_animator.create_frame()
        world_map_img = self.world_map_animator.create_frame()

        return {
            "sent_timestamp": current_time,
            "images": {
                "main_camera (this is all simulated data btw)": {
                    "image_data": main_camera_img,
                    "scale": 1,
                    "flip": False
                },
                "world_map": {
                    "image_data": world_map_img,
                    "scale": 1,
                    "flip": False
                }
            },
            "graph_data": {
                "Turret Yaw": [{
                    "x": current_time,
                    "y": self.yaw
                }],
                "Turret Pitch": [{
                    "x": current_time,
                    "y": self.pitch
                }],

            },
            "string_data": {
                "mode": {"value": self.mode},
                "game_state": {"value": self.game_state},
                "system_health": {"value": self.system_health}
            },
            "robot_position": {
                "x": self.position[0],
                "y": self.position[1],
                "heading": self.orientation
            }
        }

if __name__ == "__main__":
    bot = RoboMasterBot()
    target_fps = 1/30
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
