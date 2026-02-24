import Button from "./Button";
import Field from "./Field";
import { LockIcon, UserIcon } from "./Icons";

const Register = () => (
    <div className="bg-primary flex flex-1 items-center justify-center px-8 py-12">
        <div className="w-full max-w-sm">
            <h1 className="mb-8 text-center text-4xl font-bold text-white">Register</h1>

            <Field
                key={"first-name"}
                label={"First Name"}
                labelClassName="text-white/90"
                icon={<UserIcon />}
                inputClassName="focus-within:border-secondary"
            />
            <Field
                key={"last-name"}
                label={"Last Name"}
                labelClassName="text-white/90"
                icon={<UserIcon />}
                inputClassName="focus-within:border-secondary"
            />
            <Field
                key={"email"}
                label={"Email"}
                labelClassName="text-white/90"
                icon={<UserIcon />}
                inputClassName="focus-within:border-secondary"
            />
            <Field
                key={"password"}
                label={"Password"}
                labelClassName="text-white/90"
                type="password"
                icon={<LockIcon />}
                inputClassName="focus-within:border-secondary"
            />
            <Field
                key={"confirm-password"}
                label={"Confirm Password"}
                labelClassName="text-white/90"
                type="password"
                icon={<LockIcon />}
                inputClassName="focus-within:border-secondary"
            />
            <Field
                key={"phone-number"}
                label={"Phone Number"}
                labelClassName="text-white/90"
                icon={<UserIcon />}
                inputClassName="focus-within:border-secondary"
            />

            <Button className="text-primary mt-2 w-full bg-white hover:bg-gray-100 active:bg-gray-200">Register</Button>
        </div>
    </div>
);

export default Register;
