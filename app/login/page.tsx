import AuthForm from '@/components/AuthForm';

export default function LoginPage() {
  return (
    <div className="max-w-md mx-auto px-4 py-12">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold gradient-text mb-2">登录账户</h1>
        <p className="text-slate-500 text-sm">
          登录后可管理您的合同审查记录和历史数据
        </p>
      </div>
      <AuthForm />
    </div>
  );
}
