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
      <IconBellFilled
        size={20}
        onClick={toggleDropdown}
        className="cursor-pointer"
      />
      {notifications > 0 && (
        <span className="absolute top-8 right-22 rounded bg-red-500 p-1 text-xs text-white"></span>
      )}
      {isOpen && (
        <div className="absolute -right-0 flex w-1/8 justify-center border bg-white p-2">
          {notifications > 0 ? <p>Critical Alert</p> : <p>No notifications</p>}
        </div>
      )}
    </div>
  );
}

export default Notifications;
