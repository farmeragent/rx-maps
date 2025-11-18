import "@copilotkit/react-ui/styles.css";
import { CopilotSidebar } from "@copilotkit/react-ui";


export default function YourApp() {
return (
    <main>
    <h1>Your main content</h1>
    <CopilotSidebar
        labels={{
            title: "Farm Pulse Assistant",
            initial: "Hi! How can I help?",
        }}
    />
    </main>
);
}