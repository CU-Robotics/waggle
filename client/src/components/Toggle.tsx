import { useState } from "react";

export default function Toggle({
  defaultChecked = false,
  onChange = (checked: boolean) => {
    console.log(checked);
  },
  size = "normal",
  disabled = false,
}) {
  const [isChecked, setIsChecked] = useState(defaultChecked);

  const handleClick = () => {
    if (!disabled) {
      const newValue = !isChecked;
      setIsChecked(newValue);
      onChange(newValue);
    }
  };

  // Determine sizes based on the size prop
  const getSize = () => {
    switch (size) {
      case "small":
        return {
          track: "w-8 h-4",
          thumb: "w-4 h-4",
          translate: "translate-x-4",
        };
      case "large":
        return {
          track: "w-16 h-8",
          thumb: "w-8 h-8",
          translate: "translate-x-8",
        };
      default:
        return {
          track: "w-12 h-6",
          thumb: "w-6 h-6",
          translate: "translate-x-6",
        };
    }
  };

  const sizes = getSize();

  return (
    <div
      onClick={handleClick}
      className={`
        relative inline-flex items-center shrink-0 cursor-pointer
        rounded-full transition-colors duration-200 ease-in-out
        ${sizes.track}
        ${isChecked ? "bg-green-500" : "bg-gray-200"}
        ${disabled ? "opacity-50 cursor-not-allowed" : ""}
      `}
    >
      <span
        className={`
          absolute left-0 inline-block 
          bg-white rounded-full shadow transform
          transition-transform duration-200 ease-in-out
          ${sizes.thumb}
          ${isChecked ? sizes.translate : "translate-x-0"}
        `}
      />
    </div>
  );
}
