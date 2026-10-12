import { Outlet } from "react-router-dom"

const SettingsPage = () => {
    return (
        <div className="h-full min-h-0 w-full min-w-0 overflow-auto p-3 sm:p-4">
            <Outlet />
        </div>
    )
}

export default SettingsPage