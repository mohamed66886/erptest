import React from "react";

const Footer = () => {
  return (
    <footer className="w-full text-center py-4 bg-gray-100 text-gray-600 mt-8 border-t">
      جميع الحقوق محفوظة لـ فُلك &copy; {new Date().getFullYear()}
    </footer>

  );
};

export default Footer;
