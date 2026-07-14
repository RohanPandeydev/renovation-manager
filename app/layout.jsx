import "./globals.css";

export const metadata = {
  title: "Renovation Manager",
  description: "Track attendance, wages, advances, materials & room budgets for your home renovation.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0f1720",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
