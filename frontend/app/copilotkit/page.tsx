"use client";
import "@copilotkit/react-ui/styles.css";
import { CopilotSidebar } from "@copilotkit/react-ui";
import { useFrontendTool } from "@copilotkit/react-core";
import { useState } from "react";


const Chat = () => {
    const [pageTitle, setPageTitle] = useState<string>(
        "Farm Pulse Home Page"
      );

    useFrontendTool({
    name: "execute_SQL_query",
    description: "Run a SQL query against the database",
    parameters: [
        {
        name: "sql",
        type: "string",
        description: "The query to run",
        required: true,
        },
    ],
    handler: async ({ sql }) => {
        return { sql };
    },
    render: ({ args, status, result }) => {
        console.log(args);
        if (status === "inProgress") {
            return <div>Executing sql query for {args.sql}...</div>;
        }
        if (status === "complete" && result) {
            setPageTitle("Hex Query Page");
            return (
                <p className="text-gray-500 mt-2">
                    {status !== "complete" && "Executing sql query..."}
                    {status === "complete" &&
                        `Ran the following query: ${args.sql}.`}
                </p>
            );
        }
        return "";
    },
    });
  
    return (
        <main>
        <h1>{pageTitle}</h1>
        <CopilotSidebar
            labels={{
                title: "Farm Pulse Assistant",
                initial: "Hi! How can I help?",
            }}
        />
        </main>
    );
};

export default function YourApp() {
    return (       
          <Chat />
      );  
}