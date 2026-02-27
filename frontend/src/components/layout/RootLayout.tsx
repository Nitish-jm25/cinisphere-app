import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';

export const RootLayout = () => {
    return (
        <div className="min-h-screen flex flex-col pt-16">
            <Navbar />
            <main className="flex-1">
                <Outlet />
            </main>
        </div>
    );
};
