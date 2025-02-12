import { useState } from "react";
import {
  IconPlayerRecordFilled,
  IconPlayerStopFilled,
} from "@tabler/icons-react";

function RecordSession() {
  const [isRecording, setIsRecording] = useState(false);

  const handleRecord = () => {
    setIsRecording(!isRecording);
  };

  return (
    <>
      {isRecording ? (
        <div
          onClick={handleRecord}
          className="flex cursor-pointer items-center gap-1 rounded-md border p-1"
        >
          <IconPlayerStopFilled size={18} color="red" />
        </div>
      ) : (
        <div
          onClick={handleRecord}
          className="flex cursor-pointer items-center gap-1 rounded-md border p-1"
        >
          <p className="text-sm font-bold">Record</p>
          <IconPlayerRecordFilled size={18} color="red" />
        </div>
      )}
    </>
  );
}

export default RecordSession;
