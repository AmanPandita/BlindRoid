import { useEffect, useState } from 'react';
import { Image, Text, View } from 'react-native';

import { styles } from '../styles/styles';
import { companyInitials, getLogoSources } from '../utils/company';

type Props = { company: string; refreshKey?: number };

export function CompanyLogo({ company, refreshKey }: Props) {
  const [sourceIndex, setSourceIndex] = useState(0);
  const logoSources = getLogoSources(company);
  const logoUrl = logoSources[sourceIndex];

  useEffect(() => {
    setSourceIndex(0);
  }, [refreshKey]);

  return (
    <View style={styles.companyLogo}>
      {logoUrl ? (
        <Image
          key={`${company}-${refreshKey}`}
          onError={() => setSourceIndex((current) => current + 1)}
          resizeMode="contain"
          source={{ uri: logoUrl }}
          style={styles.companyLogoImage}
        />
      ) : (
        <Text style={styles.companyLogoText}>{companyInitials(company)}</Text>
      )}
    </View>
  );
}
