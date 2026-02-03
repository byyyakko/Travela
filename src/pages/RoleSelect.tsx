import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { User, Store } from "lucide-react";
import mascotImage from "@/assets/mascot-cutesy.png";

const RoleSelect = () => {
  const navigate = useNavigate();

  const handleRoleSelect = (role: "user" | "merchant") => {
    localStorage.setItem("selectedRole", role);
    navigate("/auth");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50 to-pink-100 flex flex-col items-center justify-center p-6">
      {/* Mascot with speech bubble */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col items-center mb-8"
      >
        <div className="relative">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, duration: 0.4 }}
            className="absolute -top-16 left-1/2 -translate-x-1/2 bg-white px-4 py-2 rounded-2xl shadow-md border-2 border-pink-200 whitespace-nowrap"
          >
            <p className="text-pink-600 font-medium text-sm">Which are you? ✨</p>
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[8px] border-t-white"></div>
          </motion.div>
          <img
            src={mascotImage}
            alt="Mascot"
            className="w-32 h-32 object-contain mix-blend-multiply"
          />
        </div>
      </motion.div>

      {/* Role selection cards */}
      <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
        <motion.button
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4, duration: 0.4 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => handleRoleSelect("user")}
          className="flex-1 bg-white rounded-3xl p-6 shadow-lg border-2 border-pink-200 hover:border-pink-400 transition-all group"
        >
          <div className="flex flex-col items-center gap-3">
            <div className="w-16 h-16 rounded-full bg-pink-100 flex items-center justify-center group-hover:bg-pink-200 transition-colors">
              <User className="w-8 h-8 text-pink-500" />
            </div>
            <span className="text-lg font-semibold text-pink-700">User</span>
            <p className="text-sm text-pink-400 text-center">
              Looking to explore and connect
            </p>
          </div>
        </motion.button>

        <motion.button
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5, duration: 0.4 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => handleRoleSelect("merchant")}
          className="flex-1 bg-white rounded-3xl p-6 shadow-lg border-2 border-pink-200 hover:border-pink-400 transition-all group"
        >
          <div className="flex flex-col items-center gap-3">
            <div className="w-16 h-16 rounded-full bg-pink-100 flex items-center justify-center group-hover:bg-pink-200 transition-colors">
              <Store className="w-8 h-8 text-pink-500" />
            </div>
            <span className="text-lg font-semibold text-pink-700">Merchant</span>
            <p className="text-sm text-pink-400 text-center">
              Offering services or experiences
            </p>
          </div>
        </motion.button>
      </div>
    </div>
  );
};

export default RoleSelect;
