import Input from "./Input";

interface FieldProps {
    label: string;
    labelClassName?: string;
    inputClassName?: string;
    type?: string;
    icon?: React.ReactNode;
    placeholder?: string;
}

const Field = ({ label, labelClassName, inputClassName, type = "text", icon, placeholder }: FieldProps) => (
    <div className="mb-4">
        <label className={`mb-1 block text-sm font-semibold ${labelClassName ?? ""}`}>{label}</label>
        <Input type={type} icon={icon} placeholder={placeholder ?? label} className={inputClassName} />
    </div>
);

export default Field;
