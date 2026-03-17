import { useMemo } from 'react';
import { Autocomplete, TextField, Icon, Box, Typography, type AutocompleteRenderInputParams } from '@mui/material';

interface IconOption {
  name: string;
  label: string;
}

const ICON_OPTIONS: IconOption[] = [
  // Food & Dining
  { name: 'restaurant', label: '食事・レストラン' },
  { name: 'fastfood', label: 'ファストフード' },
  { name: 'local_cafe', label: 'カフェ・コーヒー' },
  { name: 'local_bar', label: 'バー・お酒' },
  { name: 'liquor', label: 'お酒・リカー' },
  { name: 'bakery_dining', label: 'パン・ベーカリー' },
  { name: 'kitchen', label: 'キッチン・自炊' },
  { name: 'emoji_food_beverage', label: '飲み物' },
  { name: 'ramen_dining', label: 'ラーメン' },
  { name: 'lunch_dining', label: 'ランチ' },
  { name: 'rice_bowl', label: 'ご飯' },
  { name: 'set_meal', label: '定食' },
  { name: 'local_pizza', label: 'ピザ' },
  { name: 'icecream', label: 'アイスクリーム' },
  // Shopping
  { name: 'shopping_cart', label: '買い物・カート' },
  { name: 'shopping_bag', label: '買い物袋' },
  { name: 'store', label: '店舗・ストア' },
  { name: 'local_mall', label: 'ショッピングモール' },
  { name: 'storefront', label: '店先' },
  { name: 'local_grocery_store', label: 'スーパー・食料品店' },
  // Transportation
  { name: 'directions_car', label: '車・自動車' },
  { name: 'train', label: '電車' },
  { name: 'directions_bus', label: 'バス' },
  { name: 'directions_subway', label: '地下鉄' },
  { name: 'flight', label: '飛行機・旅行' },
  { name: 'two_wheeler', label: 'バイク・二輪車' },
  { name: 'pedal_bike', label: '自転車' },
  { name: 'local_gas_station', label: 'ガソリンスタンド' },
  { name: 'local_taxi', label: 'タクシー' },
  { name: 'commute', label: '通勤' },
  { name: 'directions_walk', label: '徒歩' },
  // Entertainment & Hobbies
  { name: 'sports_esports', label: 'ゲーム・eスポーツ' },
  { name: 'movie', label: '映画' },
  { name: 'music_note', label: '音楽' },
  { name: 'sports_basketball', label: 'スポーツ・バスケ' },
  { name: 'sports_soccer', label: 'サッカー' },
  { name: 'sports_tennis', label: 'テニス' },
  { name: 'fitness_center', label: 'ジム・フィットネス' },
  { name: 'theater_comedy', label: '演劇・エンタメ' },
  { name: 'casino', label: '娯楽・カジノ' },
  { name: 'golf_course', label: 'ゴルフ' },
  { name: 'pool', label: 'プール' },
  { name: 'park', label: '公園' },
  { name: 'photo_camera', label: 'カメラ・写真' },
  { name: 'palette', label: 'アート・趣味' },
  { name: 'menu_book', label: '読書・本' },
  { name: 'beach_access', label: 'ビーチ・リゾート' },
  // Clothing & Beauty
  { name: 'checkroom', label: '衣服・クローゼット' },
  { name: 'dry_cleaning', label: 'クリーニング' },
  { name: 'face', label: '美容・フェイス' },
  { name: 'spa', label: 'スパ・美容' },
  { name: 'content_cut', label: '美容院・カット' },
  // Health & Medical
  { name: 'local_hospital', label: '病院・医療' },
  { name: 'medical_services', label: '医療サービス' },
  { name: 'medication', label: '薬' },
  { name: 'health_and_safety', label: '健康・安全' },
  { name: 'healing', label: '癒し・治療' },
  { name: 'vaccines', label: 'ワクチン・注射' },
  // Education
  { name: 'school', label: '学校・教育' },
  { name: 'auto_stories', label: '本・読書' },
  { name: 'history_edu', label: '教養・学習' },
  { name: 'science', label: '科学' },
  { name: 'psychology', label: '心理・学問' },
  { name: 'translate', label: '語学' },
  // Housing
  { name: 'home', label: '家・住居' },
  { name: 'house', label: '家' },
  { name: 'apartment', label: 'マンション' },
  { name: 'bed', label: 'ベッド・寝室' },
  { name: 'chair', label: '家具・椅子' },
  { name: 'weekend', label: 'リビング・ソファ' },
  { name: 'roofing', label: '屋根・修繕' },
  { name: 'plumbing', label: '水道・配管' },
  { name: 'build', label: 'DIY・修理' },
  // Utilities & Communication
  { name: 'flash_on', label: '電気・電力' },
  { name: 'wifi', label: 'WiFi・通信' },
  { name: 'phone_android', label: 'スマホ・携帯' },
  { name: 'water_drop', label: '水道' },
  { name: 'local_fire_department', label: 'ガス' },
  { name: 'thermostat', label: '暖房・空調' },
  // Insurance & Tax
  { name: 'security', label: '保険・セキュリティ' },
  { name: 'shield', label: '保険・保護' },
  { name: 'verified_user', label: '保証・認証' },
  { name: 'gavel', label: '税金・法律' },
  { name: 'account_balance', label: '税金・公共機関' },
  { name: 'policy', label: '保険・ポリシー' },
  // Finance & Work
  { name: 'payments', label: '給与・支払い' },
  { name: 'credit_card', label: 'クレジットカード' },
  { name: 'savings', label: '貯金・貯蓄' },
  { name: 'attach_money', label: 'お金' },
  { name: 'price_check', label: '価格チェック' },
  { name: 'receipt', label: 'レシート' },
  { name: 'receipt_long', label: '明細・レシート' },
  { name: 'work', label: '仕事' },
  { name: 'business_center', label: 'ビジネス' },
  { name: 'laptop', label: 'ノートPC' },
  { name: 'computer', label: 'パソコン' },
  { name: 'trending_up', label: '投資・上昇' },
  { name: 'show_chart', label: 'チャート' },
  { name: 'card_giftcard', label: 'ギフト・商品券' },
  { name: 'currency_yen', label: '円・通貨' },
  { name: 'monetization_on', label: '通貨' },
  { name: 'wallet', label: '財布' },
  { name: 'local_atm', label: 'ATM' },
  // Social
  { name: 'people', label: '人々・交際' },
  { name: 'person', label: '個人' },
  { name: 'groups', label: 'グループ' },
  { name: 'celebration', label: 'お祝い' },
  { name: 'cake', label: 'ケーキ・誕生日' },
  { name: 'redeem', label: 'プレゼント' },
  { name: 'volunteer_activism', label: '寄付・ボランティア' },
  // Family & Pets
  { name: 'child_care', label: '子育て・育児' },
  { name: 'family_restroom', label: '家族' },
  { name: 'elderly', label: '介護・高齢者' },
  { name: 'pets', label: 'ペット' },
  { name: 'cruelty_free', label: 'ペット・動物' },
  // General
  { name: 'more_horiz', label: 'その他' },
  { name: 'category', label: 'カテゴリ' },
  { name: 'label', label: 'ラベル' },
  { name: 'star', label: 'お気に入り・スター' },
  { name: 'favorite', label: 'ハート・お気に入り' },
  { name: 'flag', label: 'フラグ' },
  { name: 'bookmark', label: 'ブックマーク' },
  { name: 'lightbulb', label: 'アイデア・電球' },
  { name: 'local_offer', label: 'クーポン・割引' },
  { name: 'local_parking', label: '駐車場' },
  { name: 'local_laundry_service', label: 'ランドリー' },
  { name: 'smoking_rooms', label: 'たばこ' },
  { name: 'newspaper', label: '新聞・定期購読' },
  { name: 'subscriptions', label: 'サブスクリプション' },
  { name: 'cloud', label: 'クラウド' },
  { name: 'devices', label: 'デバイス・ガジェット' },
  { name: 'headphones', label: 'ヘッドホン' },
  { name: 'watch', label: '時計・アクセサリー' },
  { name: 'diamond', label: 'ジュエリー・宝石' },
  { name: 'toys', label: 'おもちゃ' },
  { name: 'stroller', label: 'ベビーカー' },
];

interface IconPickerProps {
  value: string;
  onChange: (value: string) => void;
  error?: boolean;
  helperText?: string;
}

export default function IconPicker({ value, onChange, error, helperText }: IconPickerProps) {
  const optionsMap = useMemo(() => {
    const map = new Map<string, IconOption>();
    for (const opt of ICON_OPTIONS) map.set(opt.name, opt);
    return map;
  }, []);

  const selectedOption = optionsMap.get(value) ?? (value ? { name: value, label: value } : null);

  return (
    <Autocomplete
      options={ICON_OPTIONS}
      value={selectedOption}
      onChange={(_, newValue) => onChange(newValue?.name ?? '')}
      getOptionLabel={(option) => `${option.label} (${option.name})`}
      filterOptions={(options, { inputValue }) => {
        if (!inputValue) return options;
        const search = inputValue.toLowerCase();
        return options.filter(
          (opt) => opt.name.includes(search) || opt.label.includes(search),
        );
      }}
      renderOption={(props, option) => {
        const { key, ...rest } = props;
        return (
          <Box component="li" key={key} {...rest} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Icon sx={{ color: 'action.active' }}>{option.name}</Icon>
            <Typography variant="body2">{option.label}</Typography>
            <Typography variant="caption" color="text.secondary">
              {option.name}
            </Typography>
          </Box>
        );
      }}
      renderInput={(params: AutocompleteRenderInputParams) => (
        <TextField
          {...params}
          label="アイコン"
          error={error}
          helperText={helperText}
          slotProps={{
            input: {
              ...params.InputProps,
              startAdornment: value ? (
                <Icon sx={{ mr: 0.5, color: 'action.active' }}>{value}</Icon>
              ) : undefined,
            },
          }}
        />
      )}
      isOptionEqualToValue={(option, val) => option.name === val.name}
      clearOnEscape
      fullWidth
    />
  );
}
