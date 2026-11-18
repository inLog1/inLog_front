import { AuthLayout } from "../../../widgets/auth-layout"
import { PasswordRecoveryForm } from "../../../features/auth/ui/PasswordRecoveryForm"

const PasswordRecoveryPage = () => {
    return (
        <AuthLayout>
            <PasswordRecoveryForm />
        </AuthLayout>
    )
}

export default PasswordRecoveryPage