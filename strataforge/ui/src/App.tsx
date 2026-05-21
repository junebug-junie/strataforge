import { useState } from "react";
import ProjectShell from "./components/ProjectShell";

function App() {
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);

  return (
    <ProjectShell
      selectedTopicId={selectedTopicId}
      onSelectTopic={setSelectedTopicId}
    />
  );
}

export default App;
