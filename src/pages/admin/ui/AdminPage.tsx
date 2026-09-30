import RootPageLayout from "../../../widgets/root-page-layout"
import { Outlet } from "react-router-dom"

const AdminPage = () => {
    return (
        <RootPageLayout navItems={[]}>
            <div className="h-full w-full">
                <div className="pl-2 min-w-0">
                    <Outlet />
                </div>
            </div>
        </RootPageLayout>
    )
}

export default AdminPage
