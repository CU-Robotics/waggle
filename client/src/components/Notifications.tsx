import { useState } from "react";
import { IconBellFilled } from "@tabler/icons-react";

// TODO define data type for notifications (we want to seperate between goal notifications, alerts, and critical alerts)

function Notifications({ notifications }: { notifications: number }) {
  const [isOpen, setIsOpen] = useState(false);

  const toggleDropdown = () => {
    setIsOpen(!isOpen);
  };

  return (
    <div className="dropdown">
      <IconBellFilled size={20} onClick={toggleDropdown} />
      {notifications > 0 && (
        <span className="text-xs bg-red-500 text-white rounded absolute p-0.75"></span>
      )}
      {isOpen && (
        <div className="absolute bg-white w-1/4">
          <h3 className="text-lg">Notifications</h3>
          <ul>
            {/* Will have list of all critical notifications */}
            <li>Alert 1</li>
            <li>Alert 2</li>
            <li>Alert 3</li>
          </ul>
        </div>
      )}
    </div>
  );
}

export default Notifications;
