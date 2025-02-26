import React, { useEffect, useState } from "react";
import axios from "axios";

function App() {
    const [message, setMessage] = useState("Loading...");

    useEffect(() => {
        axios.get("http://localhost:8000/")
            .then(response => {
                setMessage(response.data.message);
            })
            .catch(error => {
                console.error("Error fetching data:", error);
                setMessage("Error fetching data.");
            });
    }, []);

    return (
        <div>
            <h1>Photometry Web App</h1>
            <p>Backend says: {message}</p>
        </div>
    );
}

export default App;


