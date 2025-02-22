import numpy as np

def generate_rose_curve(n, d, num_points):
    points = []
    k = n/d
    theta = np.linspace(0, 2*np.pi*d, num_points)
    r = np.cos(k * theta)
    x = r * np.cos(theta)
    y = r * np.sin(theta)
    for i in range(num_points):
        points.append({
            "x":x[i],
            "y":y[i]
            })
    return points
