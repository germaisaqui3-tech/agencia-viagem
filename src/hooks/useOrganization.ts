import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

export const useOrganization = () => {
  const navigate = useNavigate();
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadOrganization = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        console.log('[useOrganization] User:', user?.id);
        
        if (!user) {
          console.log('[useOrganization] No user found');
          setLoading(false);
          return;
        }

        // Verificar se usuário tem role
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .maybeSingle();

        console.log('[useOrganization] Role data:', roleData);

        // Se não tem role, não redirecionar - deixar useAuthProtection lidar
        if (!roleData) {
          console.log('[useOrganization] No role found');
          setLoading(false);
          return;
        }

        // Buscar organização padrão do perfil
        const { data: profile } = await supabase
          .from('profiles')
          .select('default_organization_id')
          .eq('id', user.id)
          .single();

        console.log('[useOrganization] Profile default_org:', profile?.default_organization_id);

        if (profile?.default_organization_id) {
          setOrganizationId(profile.default_organization_id);
          console.log('[useOrganization] Set organizationId from profile:', profile.default_organization_id);
        } else {
          // Fallback: buscar primeira organização do usuário
          const { data: membership } = await supabase
            .from('organization_members')
            .select('organization_id')
            .eq('user_id', user.id)
            .eq('is_active', true)
            .order('joined_at', { ascending: true })
            .limit(1)
            .maybeSingle();

          console.log('[useOrganization] Membership org:', membership?.organization_id);

          if (membership) {
            setOrganizationId(membership.organization_id);
            console.log('[useOrganization] Set organizationId from membership:', membership.organization_id);
            // Atualizar como padrão
            await supabase
              .from('profiles')
              .update({ default_organization_id: membership.organization_id })
              .eq('id', user.id);
          } else {
            // Usuário não tem organização - redirecionar para criar
            console.log('[useOrganization] No organization found, redirecting...');
            const currentPath = window.location.pathname;
            if (currentPath !== '/organization/create' && currentPath !== '/auth' && !currentPath.startsWith('/invite/')) {
              navigate('/organization/create');
            }
          }
        }
      } catch (error) {
        console.error('[useOrganization] Error loading organization:', error);
      } finally {
        setLoading(false);
        console.log('[useOrganization] Loading complete');
      }
    };

    loadOrganization();
  }, [navigate]);

  return { organizationId, loading };
};

