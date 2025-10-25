import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useOrganization = () => {
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadOrganization = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          setLoading(false);
          return;
        }

        // Buscar organização padrão do perfil
        const { data: profile } = await supabase
          .from('profiles')
          .select('default_organization_id')
          .eq('id', user.id)
          .single();

        if (profile?.default_organization_id) {
          setOrganizationId(profile.default_organization_id);
        } else {
          // Fallback: buscar primeira organização do usuário
          const { data: membership } = await supabase
            .from('organization_members')
            .select('organization_id')
            .eq('user_id', user.id)
            .eq('is_active', true)
            .order('joined_at', { ascending: true })
            .limit(1)
            .single();

          if (membership) {
            setOrganizationId(membership.organization_id);
          }
        }
      } catch (error) {
        console.error('Erro ao carregar organização:', error);
      } finally {
        setLoading(false);
      }
    };

    loadOrganization();
  }, []);

  return { organizationId, loading };
};
