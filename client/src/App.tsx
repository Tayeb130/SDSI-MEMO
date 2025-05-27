import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

function App() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullname, setFullname] = useState("");
  const [error, setError] = useState("");
  const [isLogin, setIsLogin] = useState(true);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      if (isLogin) {
        if (!email || !password) {
          setError("Veuillez remplir tous les champs");
          return;
        }

        const response = await axios.post(
          "http://localhost:5000/api/user/login",
          { email, password }
        );

        if (response.data) {
          localStorage.setItem("user", JSON.stringify(response.data));
          setEmail("");
          setPassword("");
          setError("");

          navigate("/dashboard");
        }
      } else {
        if (!fullname || !email || !password) {
          setError("Veuillez remplir tous les champs");
          return;
        }

        const response = await axios.post(
          "http://localhost:5000/api/user/register",
          { fullname, email, password }
        );

        if (response.data) {
          localStorage.setItem("user", JSON.stringify(response.data));
          setEmail("");
          setPassword("");
          setFullname("");
          setError("");

          navigate("/dashboard");
        }
      }
    } catch (err: any) {
      console.error("Error:", err);
      setError(err.response?.data?.message || "Une erreur s'est produite");
    }
  };

  const toggleForm = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsLogin(!isLogin);
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-[#d5e3ff] to-[#a3c2ff]">
      <div
        id="AuthForm"
        className="flex flex-row justify-center items-center bg-white shadow-lg rounded-lg w-[90%] md:w-[75%] h-[80vh] overflow-hidden relative"
      >
        {/* Left Side Illustrations Container */}
        <div className="hidden md:block w-1/2 h-full relative overflow-hidden">
          {/* Login Illustration */}
          <div
            className={`absolute inset-0 flex bg-green-100 w-full h-full flex-col justify-center items-center gap-6 transition-transform duration-700 ease-in-out ${
              isLogin ? "translate-x-0" : "-translate-x-full"
            }`}
          >
            <div className="flex justify-center items-center">
              <img
                src="/Maintenance-cuate.svg"
                alt="Illustration"
                className="w-64 h-64"
              />
            </div>
            <h2 className="text-gray-800 text-xl font-semibold text-center">
              Bienvenue Sur Surveillance Industrielle
            </h2>
          </div>

          {/* Register Illustration */}
          <div
            className={`absolute inset-0 flex bg-green-100 w-full h-full flex-col justify-center items-center gap-6 transition-transform duration-700 ease-in-out ${
              !isLogin ? "translate-x-0" : "translate-x-full"
            }`}
          >
            <div className="flex justify-center items-center">
              <img
                src="/Maintenance-cuate.svg"
                alt="Illustration"
                className="w-64 h-64"
              />
            </div>
            <h2 className="text-gray-800 text-xl font-semibold text-center">
              Rejoignez Surveillance Industrielle Maintenant!
            </h2>
          </div>
        </div>

        {/* Forms Container */}
        <div className="w-full md:w-1/2 h-full relative">
          {/* Login Form */}
          <div
            className={`absolute inset-0 w-full h-full flex items-center justify-center transform transition-all duration-700 ease-in-out ${
              isLogin
                ? "translate-x-0 opacity-100"
                : "translate-x-full opacity-0"
            }`}
          >
            <form onSubmit={handleSubmit} className="w-full max-w-md px-8">
              <div className="flex flex-row justify-center items-center space-x-4 mb-6">
                <img
                  src="/unnamed.png"
                  alt="University Logo"
                  className="w-24 h-24"
                />
                <img
                  src="/images__5_-removebg-preview.png"
                  alt="Faculty Logo"
                  className="w-24 h-24"
                />
              </div>
              <h2 className="text-3xl font-bold text-center mb-8 text-gray-800">
                Connexion
              </h2>
              {error && (
                <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md text-sm">
                  {error}
                </div>
              )}
              <div className="space-y-4">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email"
                  className="w-full px-4 py-3 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mot de passe"
                  className="w-full px-4 py-3 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
                <button
                  type="submit"
                  className="w-full bg-blue-500 py-3 rounded-md text-white font-semibold hover:bg-blue-600 transition-colors"
                >
                  Se connecter
                </button>
              </div>
              <div className="mt-4 text-center">
                <p className="text-gray-600">
                  Vous n'avez pas de compte?{" "}
                  <a
                    href="/register"
                    onClick={toggleForm}
                    className="text-blue-500 hover:underline"
                  >
                    Inscrivez-vous
                  </a>
                </p>
              </div>
            </form>
          </div>

          {/* Register Form */}
          <div
            className={`absolute inset-0 w-full h-full flex items-center justify-center transform transition-all duration-700 ease-in-out ${
              !isLogin
                ? "translate-x-0 opacity-100"
                : "-translate-x-full opacity-0"
            }`}
          >
            <form onSubmit={handleSubmit} className="w-full max-w-md px-8">
              <div className="flex flex-row justify-center items-center space-x-4 mb-6">
                <img
                  src="/unnamed.png"
                  alt="University Logo"
                  className="w-24 h-24"
                />
                <img
                  src="/images__5_-removebg-preview.png"
                  alt="Faculty Logo"
                  className="w-24 h-24"
                />
              </div>
              <h2 className="text-3xl font-bold text-center mb-8 text-gray-800">
                Inscription
              </h2>
              <div className="space-y-4">
                <input
                  type="text"
                  value={fullname}
                  onChange={(e) => setFullname(e.target.value)}
                  placeholder="Nom complet"
                  className="w-full px-4 py-3 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email"
                  className="w-full px-4 py-3 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mot de passe"
                  className="w-full px-4 py-3 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
                <button
                  type="submit"
                  className="w-full bg-blue-500 py-3 rounded-md text-white font-semibold hover:bg-blue-600 transition-colors"
                >
                  S'inscrire
                </button>
              </div>
              <div className="mt-4 text-center">
                <p className="text-gray-600">
                  Déjà inscrit?{" "}
                  <a
                    href="/login"
                    onClick={toggleForm}
                    className="text-blue-500 hover:underline"
                  >
                    Connectez-vous
                  </a>
                </p>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
