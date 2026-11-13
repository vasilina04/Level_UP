import type { Metadata } from "next";
import "@fontsource-variable/inter";
import "./globals.css";
export const metadata:Metadata={title:{default:"LEVEL UP · Универ",template:"%s · LEVEL UP"},description:"Конкурсный прототип цифрового деканата",icons:{icon:"/icon.svg"}};
export default function RootLayout({children}:{children:React.ReactNode}) {
  return <html lang="ru"><body>{children}</body></html>;
}
