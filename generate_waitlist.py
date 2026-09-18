import pandas as pd
import numpy as np
import os

def create_waitlist():
    print("Generating synthetic waitlist...")
    
    specialties = ['General Practice', 'Cardiology', 'Pediatrics', 'Orthopedics', 'Neurology', 'Internal Medicine']
    urgency_levels = ['Low', 'Medium', 'High']
    days_of_week = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Any']
    time_slots = ['Morning', 'Afternoon', 'Any']
    
    np.random.seed(42)
    num_patients = 200
    
    data = {
        'WaitlistID': [f"WL-{1000 + i}" for i in range(num_patients)],
        'PatientName': [f"Patient_{i}" for i in range(num_patients)], 
        'Specialty': np.random.choice(specialties, num_patients, p=[0.3, 0.2, 0.2, 0.1, 0.05, 0.15]),
        'DaysWaiting': np.random.randint(5, 90, num_patients),
        'Urgency': np.random.choice(urgency_levels, num_patients, p=[0.5, 0.3, 0.2]),
        'PreferredDay': np.random.choice(days_of_week, num_patients, p=[0.1, 0.1, 0.1, 0.1, 0.1, 0.5]),
        'PreferredTime': np.random.choice(time_slots, num_patients, p=[0.3, 0.3, 0.4]),
        'ContactNumber': [f"+1-555-01{np.random.randint(10, 99)}" for _ in range(num_patients)]
    }
    
    df_waitlist = pd.DataFrame(data)
    
    save_dir = r"D:\Desktop\BootCamp_Hackathon\data\synthetic"
    os.makedirs(save_dir, exist_ok=True)
    
    save_path = os.path.join(save_dir, "waitlist.csv")
    df_waitlist.to_csv(save_path, index=False)
    
    print(f"✅ Waitlist successfully created at: {save_path}")

if __name__ == "__main__":
    create_waitlist()