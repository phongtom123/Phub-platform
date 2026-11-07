import InternalApp from "@internal/components/admin/admin-app";
export default async function DataPage({params}:{params:Promise<{resource:string}>}) {
  const {resource}=await params;
  return <InternalApp dataResource={resource} />;
}
