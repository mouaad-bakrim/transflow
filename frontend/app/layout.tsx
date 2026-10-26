import "./globals.css";
import "./commercial.css";
export const metadata = {
  title: "FLEETTRANSPORT PRO",
  description: "ERP de transport routier",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
