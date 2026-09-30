import { Outlet } from "react-router-dom"

const SettingsPage = () => {
    return (
        <div className="h-[calc(100vh-64px-8px)] w-full min-w-0 overflow-auto p-4">
            <Outlet />
        </div>
    )
}

export default SettingsPage