import { useState } from "react";
import { IconBellFilled } from "@tabler/icons-react";

// TODO define data type for notifications (we want to seperate between goal notifications, alerts, and critical alerts)

function Notifications({ notifications }: { notifications: number }) {
  const [isOpen, setIsOpen] = useState(false);

  const toggleDropdown = () => {
    setIsOpen(!isOpen);
  };

  return (
    <div className="dropdown relative">
      <IconBellFilled
        size={20}
        onClick={toggleDropdown}
        className="cursor-pointer"
      />
      {notifications > 0 && (
        <span className="absolute -top-0.5 -right-0.5 flex size-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"></span>
          <span className="relative inline-flex size-2 rounded-full bg-red-500"></span>
        </span>
      )}
      {isOpen && (
        <div className="absolute -right-0 flex w-fit justify-center border bg-white p-2">
          {notifications > 0 ? <p>Critical Alert</p> : <p>No notifications</p>}
        </div>
      )}
    </div>
  );
}

export default Notifications;
