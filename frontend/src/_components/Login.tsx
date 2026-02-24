import Button from "./Button";
import Field from "./Field";
import { LockIcon, UserIcon } from "./Icons";

const Login = () => (
    <div className="flex flex-1 items-center justify-center bg-white px-8 py-12">
        <div className="w-full max-w-sm">
            <h1 className="text-primary mb-8 text-center text-4xl font-bold">Login</h1>
            <Field label="Email" labelClassName="text-gray-600" inputClassName="border-gray-400" icon={<UserIcon />} />
            <Field
                label="Password"
                labelClassName="text-gray-600"
                inputClassName="border-gray-400"
                type="password"
                icon={<LockIcon />}
            />
            <Button className="bg-primary hover:bg-primary-hover active:bg-primary-active mt-2 w-full text-white">
                Log In
            </Button>

            <div className="mt-6 text-center">
                <a href="#" className="text-sm text-gray-500 underline transition-colors hover:text-gray-700">
                    Forgot Password?
                </a>
            </div>
        </div>
    </div>
);

export default Login;
