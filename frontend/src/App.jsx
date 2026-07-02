import './App.css';
import {Routes, Route} from "react-router-dom";
import PublicLayout from "./layouts/PublicLayout";
import Home from "./pages/Home/HOme";

function App() {
  return (
    <Routes>
      <Route 
        path = "/"
        element={
          <PublicLayout>
            <Home />
          </PublicLayout>
        }
      />
    </Routes>
  );
}

export default App;